import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ModelLogsNotifierService {
  private unreadLogs: { [modelId: string]: boolean } = {};

  // Emits { modelId, unread } whenever unread state changes for any model
  private changesSubject: Subject<{ modelId: string; unread: boolean }> = new Subject();

  hasUnreadLogs(modelId: string): boolean {
    return !!this.unreadLogs[modelId];
  }

  setUnread(modelId: string, unread: boolean) {
    this.unreadLogs[modelId] = unread;
    this.changesSubject.next({ modelId, unread });
  }

  markAsRead(modelId: string) {
    this.setUnread(modelId, false);
  }

  // Observable stream of changes
  changes(): Observable<{ modelId: string; unread: boolean }> {
    return this.changesSubject.asObservable();
  }
}
