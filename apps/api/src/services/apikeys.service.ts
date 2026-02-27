export interface ApiKeyRecord {
    id: string;
    label: string;
    createdAt: string;
}

export function listApiKeys(): ApiKeyRecord[] {
    return [
        { id: 'ak_1', label: 'Production Key', createdAt: '2025-01-01T00:00:00.000Z' },
    ];
}
