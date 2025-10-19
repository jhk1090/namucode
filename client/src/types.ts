export type ParsedData = any;
export interface ToHtmlOptions {
    document: {
        namespace: string;
        title: string;
    }
    [key: string]: any;
}

// 부모 -> 자식 메시지
export interface IWorkerToHtmlMessage {
    id: string;
    command: 'toHtml';
    parsed: ParsedData;
    options: ToHtmlOptions;
}

export interface IWorkerParserMessage {
    id: string;
    command: 'parser';
    text: string;
}

// 자식 -> 부모 응답 (성공)
export interface IWorkerToHtmlResponseSuccess {
    id: string;
    status: 'success';
    html: string;
    categories: any[];
}

export interface IWorkerParserResponseSuccess {
    id: string;
    status: 'success';
    parsed: any;
    html: string;
    hasError: boolean;
}

// 자식 -> 부모 응답 (오류)
export interface IWorkerResponseError {
    id: string;
    status: 'error';
    message: string;
}

// 자식 -> 부모 응답 전체
export type IWorkerResponse = IWorkerToHtmlResponseSuccess | IWorkerParserResponseSuccess | IWorkerResponseError;