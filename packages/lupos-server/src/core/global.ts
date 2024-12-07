import type * as TS from 'typescript'
import {TemplateSlotPlaceholder} from '../lupos-ts-module'


export let ts: typeof TS
export let factory: TS.NodeFactory


/** Set global context. */
export function setGlobalContext(typescript: typeof TS) {
	ts = typescript
	factory = typescript.factory
	TemplateSlotPlaceholder.initialize(typescript)
}
