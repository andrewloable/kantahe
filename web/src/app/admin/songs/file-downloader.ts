import { Injectable } from '@angular/core';

/** Starts the browser's download of an address under a file name (a link that is clicked); tests put a fake in its place. */
@Injectable({ providedIn: 'root' })
export class FileDownloader {
  save(url: string, fileName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
