import {getLanguageService as getHTMLLanguageService, LanguageService as HTMLLanguageService} from 'vscode-html-languageservice'
import {LanguageService as CSSLanguageService, getSCSSLanguageService, getCSSLanguageService} from 'vscode-css-languageservice'


/** Uses scss language service, except css completion service. */
export function useScssService(): CSSLanguageService {
	let scssService = {...getSCSSLanguageService()}
	let cssService = getCSSLanguageService()

	// Use css completion service.
	scssService.doComplete = cssService.doComplete

	return scssService
}


export const SharedHTMLService: HTMLLanguageService = getHTMLLanguageService()
export const SharedCSSService: CSSLanguageService = useScssService()