import type * as TS from 'typescript'
import {Logger, setGlobalContext, ProjectContext} from './core'
import {helperOfContext} from './lupos-ts-module'
import {TSLanguageServiceProxy} from './shared-services/decorator'


// How to debug typescript plugin:
// https://github.com/microsoft/TypeScript/wiki/Debugging-Language-Service-in-VS-Code


/** Entry of the ts plugin. */
export class LuposPlugin implements TS.server.PluginModule {

	private readonly ts: typeof TS

	/** Avoid decorate a single ts language server for twice. */
	private decoratedServices: WeakMap<TS.LanguageService, TS.LanguageService> = new WeakMap()

	constructor(typescript: typeof TS) {
		this.ts = typescript
	}

	/** Get automatically call create after plugin get initialized. */
	create(info: TS.server.PluginCreateInfo): TS.LanguageService {

		// Initialize context and logger.
		setGlobalContext(this.ts)

		let project = info.project
		let programGetter = () => info.languageService.getProgram()!
		let typeCheckerGetter = () => programGetter().getTypeChecker()
		let helper = helperOfContext(this.ts, typeCheckerGetter)

		let context: ProjectContext = {
			service: info.languageService,
			project,

			// Must get it dynamically.
			get program() {
				return programGetter()
			},
			get typeChecker() {
				return typeCheckerGetter()
			},
			helper,
		}

		Logger.initialize(info.project.projectService.logger)

		if (this.decoratedServices.has(info.languageService)) {
			return this.decoratedServices.get(info.languageService)!
		}

		let decoratedService = this.createDecoratedLanguageService(context)
		this.decoratedServices.set(info.languageService, decoratedService)

		return decoratedService
	}

	/** Provides variety of services for a typescript document. */
	private createDecoratedLanguageService(context: ProjectContext): TS.LanguageService {
		return new TSLanguageServiceProxy(context).decorate()
	}

	onConfigurationChanged(_config: any) {}
}


