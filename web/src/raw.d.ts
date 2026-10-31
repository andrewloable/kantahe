// A stylesheet imported with { loader: 'text' } arrives as its text; the theme colour test reads
// src/styles.css that way.
declare module '*.css' {
  const text: string;
  export default text;
}
