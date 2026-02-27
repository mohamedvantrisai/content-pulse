export interface SuccessEnvelope<T> {
    data: T;
    meta: {
        dateRange?: string;
        generatedAt: string;
        cached: boolean;
    };
}

export interface ErrorEnvelope {
    error: {
        code: string;
        message: string;
        details: unknown[];
    };
}

export function successResponse<T>(
    data: T,
    meta?: { dateRange?: string; cached?: boolean },
): SuccessEnvelope<T> {
    return {
        data,
        meta: {
            ...(meta?.dateRange !== undefined && { dateRange: meta.dateRange }),
            generatedAt: new Date().toISOString(),
            cached: meta?.cached ?? false,
        },
    };
}

export function errorResponse(
    code: string,
    message: string,
    details: unknown[] = [],
): ErrorEnvelope {
    return {
        error: {
            code,
            message,
            details,
        },
    };
}
