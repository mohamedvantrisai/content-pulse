export interface StrategyBrief {
    id: string;
    title: string;
    status: string;
}

export function getStrategyBrief(): StrategyBrief {
    return {
        id: 'sb_1',
        title: 'Q1 Content Strategy',
        status: 'active',
    };
}
