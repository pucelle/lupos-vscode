import {getLanguageService as getHTMLLanguageService, LanguageService as HTMLLanguageService} from 'vscode-html-languageservice'
import {LanguageService as CSSLanguageService, getCSSLanguageService} from 'vscode-css-languageservice'


export const SharedHTMLService: HTMLLanguageService = getHTMLLanguageService()
export const SharedCSSService: CSSLanguageService = getCSSLanguageService()