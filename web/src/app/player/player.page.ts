import { Component } from '@angular/core';
import { PlayerViewComponent } from './player-view.component';

/** /player: the full-screen player inside the app (a browser or a TV package). */
@Component({ selector: 'app-player-page', imports: [PlayerViewComponent], template: '<app-player-view />' })
export class PlayerPage {}
