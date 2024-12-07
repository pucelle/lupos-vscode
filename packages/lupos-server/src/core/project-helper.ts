
import type * as TS from 'typescript'
import {Helper} from '../lupos-ts-module'


/** Help to get some info within a project */
export class ProjectHelper {

	readonly project: TS.server.Project
	readonly helper: Helper

	constructor(project: TS.server.Project, helper: Helper) {
		this.project = project
		this.helper = helper
	}

	/** Get source file by file name. */
	getSourceFile(fileName: string): TS.SourceFile | undefined {
		return this.project.getLanguageService().getProgram()!.getSourceFile(fileName)
	}

	/** Get node at the specified offset of source file. */
	getNodeAtOffset(fileName: string, offset: number): TS.Node | undefined {
		let sourceFile = this.getSourceFile(fileName)
		return sourceFile ? this.helper.getNodeAtOffset(sourceFile, offset) : undefined
	}

	/** Get line and character position at the specified offset of a named file. */
	getPosition(fileName: string, offset: number): TS.LineAndCharacter {
		let scriptInto = this.project.getScriptInfo(fileName)
		if (!scriptInto) {
			return {line: 0, character: 0}
		}

		let location = scriptInto.positionToLineOffset(offset)
		return {line: location.line - 1, character: location.offset - 1}
	}

	/** Get offset at the specified line and character of a named file. */
	getOffset(fileName: string, {line, character}: TS.LineAndCharacter) {
		let scriptInto = this.project.getScriptInfo(fileName)
		if (!scriptInto) {
			return 0
		}

		return scriptInto.lineOffsetToPosition(line + 1, character + 1)
	}
}