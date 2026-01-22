/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/// <reference path="./emscripten-types.d.ts" />

declare module 'entry-data:*' {
  export const main: string;
  export const deps: string[];
}

declare module 'url:*' {
  const value: string;
  export default value;
}

declare module 'img-url:*' {
  const value: string;
  export default value;
  export const width: number;
  export const height: number;
}

declare module 'omt:*' {
  const value: string;
  export default value;
}

declare module 'css:*' {
  const source: string;
  export default source;
}

declare module 'data-url:*' {
  const url: string;
  export default url;
}

declare module 'data-url-text:*' {
  const url: string;
  export default url;
}

declare module 'service-worker:*' {
  const url: string;
  export default url;
}

declare const __PRODUCTION__: boolean;
declare const __PRERENDER__: boolean;

declare module 'linkstate' {
  import { Component } from 'preact';
  export default function linkState<S, K extends keyof S>(
    component: Component<any, S>,
    key: K,
    eventPath?: string,
  ): (event: Event) => void;
}

declare module 'pointer-tracker' {
  export interface Pointer {
    id: number;
    nativePointer: Touch | PointerEvent | MouseEvent;
    pageX: number;
    pageY: number;
    clientX: number;
    clientY: number;
    getCoalesced(): Pointer[];
  }

  export interface PointerTrackerCallbacks {
    start?: (
      pointer: Pointer,
      event: TouchEvent | PointerEvent | MouseEvent,
    ) => boolean;
    move?: (
      previousPointers: Pointer[],
      currentPointers: Pointer[],
      event: TouchEvent | PointerEvent | MouseEvent,
    ) => void;
    end?: (
      pointer: Pointer,
      event: TouchEvent | PointerEvent | MouseEvent,
      cancelled: boolean,
    ) => void;
    rawUpdates?: boolean;
    avoidPointerEvents?: boolean;
  }

  export default class PointerTracker {
    constructor(element: Element, callbacks: PointerTrackerCallbacks);
    readonly currentPointers: Pointer[];
    readonly startPointers: Pointer[];
    stop(): void;
  }
}
