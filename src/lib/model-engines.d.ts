declare module 'occt-import-js' {
  const initialize: (options: {
    locateFile: (name: string) => string;
  }) => Promise<import('./extended-model').OcctApi>;
  export default initialize;
}
declare module 'assimpjs' {
  const initialize: (options: {
    locateFile: (name: string) => string;
  }) => Promise<import('./extended-model').AssimpApi>;
  export default initialize;
}
