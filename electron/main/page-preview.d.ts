export declare function capturePagePreview(url: string): Promise<{
    text: string;
    images?: {
        mediaType: string;
        data: string;
    }[];
}>;
