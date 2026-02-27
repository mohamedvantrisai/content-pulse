export interface Channel {
    id: string;
    name: string;
    platform: string;
}

export function listChannels(): Channel[] {
    return [
        { id: 'ch_1', name: 'Main Instagram', platform: 'instagram' },
        { id: 'ch_2', name: 'Company LinkedIn', platform: 'linkedin' },
    ];
}
