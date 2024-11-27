import type * as TS from 'typescript'
import {PluginConfig} from './config'


/** 
 * Provide logger service, can be used to pass from ts service to template language service.
 * See https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin
 */
export class Logger {

	private logger: TS.server.Logger

	/** Initialize after captured plugin create info. */
	constructor(logger: TS.server.Logger) {
		this.logger = logger
	}

	log(message: any) {
		if (message && typeof message === 'object') {
			message = JSON.stringify(message)
		}

		this.logger.info(`[${PluginConfig.pluginName}] ${message}`)
	}

	/** Print debug info only in debugging mode. */
	debug(message: any) {
		if (PluginConfig.debugging) {
			this.log(message)
		}
	}
}
