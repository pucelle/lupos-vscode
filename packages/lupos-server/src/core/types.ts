import type TS from 'typescript'
import {Helper} from '../lupos-ts-module'


/** Shared context per project. */
export interface ProjectContext {

	/** Original TypeScript language service. */
	service: TS.LanguageService

	/** Host used by tsserver, including open and virtual project files. */
	languageServiceHost: TS.LanguageServiceHost

	/** Project that owns the decorated language service. */
	project: TS.server.Project

	/** Current real TypeScript program. */
	program: TS.Program

	/** Checker belonging to the current real program. */
	typeChecker: TS.TypeChecker

	/** Shared Lupos TypeScript helper. */
	helper: Helper
}
