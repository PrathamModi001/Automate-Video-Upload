// Video related types
export interface BunnyVideoCreateResponse {
    videoLibraryId: number;
    guid: string;
    title: string;
    dateUploaded: string;
    views: number;
    isPublic: boolean;
    length: number;
    status: number;
    frameworkUrl: string;
    thumbnailUrl: string;
    mp4Url: string;
}

export interface VideoUploadMetadata {
    title: string;
    collection?: string;
    thumbnailTime?: number;
    filetype: string;
}

// TUS upload
export interface TUSUploadSignature {
    signature: string;
    expire: number;
    videoId: string;
    libraryId: number;
}

export interface TUSUploadConfig {
    endpoint: string;
    headers: {
        AuthorizationSignature: string;
        AuthorizationExpire: number;
        VideoId: string;
        LibraryId: number;
    };
    metadata: VideoUploadMetadata;
    retryDelays: number[];
}

// Video status codes
export enum VideoStatus {
    CREATED = 0,
    UPLOADED = 1,
    PROCESSING = 2,
    TRANSCODING = 3,
    FINISHED = 4,
    ERROR = 5,
}
