import type * as TS from 'typescript'
import {LuposPlugin} from './plugin'


export = ((mod: {typescript: typeof TS}) => {
	return new LuposPlugin(mod.typescript)
}) as TS.server.PluginModuleFactory
