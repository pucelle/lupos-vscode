import * as TS from 'typescript'


export let ts: typeof TS
export let factory: TS.NodeFactory


/** Set global context. */
export function setGlobalContext(typescript: typeof TS) {
	ts = typescript
	factory = typescript.factory
}
