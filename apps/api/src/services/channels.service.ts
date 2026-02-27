export interface Channel {
    id: string;
    name: string;
    platform: string;
}

export function listChannels(): Channel[] {
    return [
        { id: 'ch_1', name: 'Main Twitter', platform: 'twitter' },
        { id: 'ch_2', name: 'Company Blog', platform: 'blog' },
    ];
}
