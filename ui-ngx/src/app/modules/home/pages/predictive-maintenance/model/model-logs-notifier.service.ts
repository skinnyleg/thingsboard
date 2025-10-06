import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModelLogsNotifierService {
  private unreadLogs: { [modelId: string]: boolean } = {};

  hasUnreadLogs(modelId: string): boolean {
    return !!this.unreadLogs[modelId];
  }

  setUnread(modelId: string, unread: boolean) {
    this.unreadLogs[modelId] = unread;
  }

  markAsRead(modelId: string) {
    this.unreadLogs[modelId] = false;
  }
}
