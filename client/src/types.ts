export type ParsedData = any;
export interface ToHtmlOptions {
    namespace: string;
    title: string;
    [key: string]: any;
}

// 부모 -> 자식 메시지
export interface IWorkerMessage {
    id: string;
    command: 'toHtml';
    parsed: ParsedData;
    options: ToHtmlOptions;
}

// 자식 -> 부모 응답 (성공)
export interface IWorkerResponseSuccess {
    id: string;
    status: 'success';
    html: string;
}

// 자식 -> 부모 응답 (오류)
export interface IWorkerResponseError {
    id: string;
    status: 'error';
    message: string;
}

// 자식 -> 부모 응답 전체
export type IWorkerResponse = IWorkerResponseSuccess | IWorkerResponseError;