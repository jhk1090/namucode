import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private channel: vscode.OutputChannel;
  private isDevelopment: boolean;

  constructor(channelName: string) {
    this.channel = vscode.window.createOutputChannel(channelName);
    // 현재 환경이 개발 모드인지 확인 (Extension 개발 호스트 환경 등)
    const production = process.argv.includes('--production')
    this.isDevelopment = !production;
  }

  private log(level: LogLevel, message: string, error?: any) {
    // 운영 환경에서는 DEBUG 로그를 숨김
    if (level === 'DEBUG' && !this.isDevelopment) {
      return;
    }

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (error) {
      if (error instanceof Error) {
        logMessage += `\n[Stack]: ${error.stack}`;
      } else {
        logMessage += `\n[Error Data]: ${JSON.stringify(error)}`;
      }
    }

    // VS Code Output 채널에 출력
    this.channel.appendLine(logMessage);

    // 개발 중일 때는 실제 개발자 도구 콘솔에도 출력
    if (this.isDevelopment) {
      const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
      console[consoleMethod](logMessage);
    }
  }

  public debug(...messages: string[]) { this.log('DEBUG', messages.join(" ")); }
  public info(...messages: string[]) { this.log('INFO', messages.join(" ")); }
  public warn(...messages: string[]) { this.log('WARN', messages.join(" ")); }
  public error(message: string, error?: any) { this.log('ERROR', message, error); }
  
  public show() { this.channel.show(); }
  public dispose() { this.channel.dispose(); }
}

export const logger = new Logger("Namucode Client");