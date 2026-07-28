declare module 'culori' {
  export interface Oklch {
    mode: 'oklch';
    l: number;
    c: number;
    h?: number;
    alpha?: number;
  }

  export interface Rgb {
    mode: 'rgb';
    r: number;
    g: number;
    b: number;
    alpha?: number;
  }

  export function converter(mode: 'oklch'): (color: string | object) => Oklch | undefined;
  export function converter(mode: 'rgb'): (color: string | object) => Rgb | undefined;
  export function formatHex(color: string | object): string;
  export function clampChroma(
    color: string | object,
    mode?: string,
    rgbGamut?: string,
  ): object;
}
