import * as ts from 'typescript'
import {LuposPlugin} from './plugin'


export default ((mod: {typescript: typeof ts}) => {
	return new LuposPlugin(mod.typescript)
}) as ts.server.PluginModuleFactory
