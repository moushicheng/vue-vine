import type { Node } from '@babel/types'
import type { VineCompileCtx, VineCompilerCtx, VineCompilerHooks, VineCompilerOptions, VineFileCtx } from './types'
import MagicString from 'magic-string'
import { analyzeVine } from './analyze'
import { findAllExportNamedDeclarations, findVineCompFnDecls } from './babel-helpers/ast'
import { babelParse } from './babel-helpers/parse'
import { transformFile } from './transform'
import { createLinkedCodeTag } from './utils'
import { validateVine } from './validate'

export {
  findVineCompFnDecls,
} from './babel-helpers/ast'

export {
  VineBindingTypes,
} from './constants'

export {
  compileVineStyle,
} from './style/compile'

export {
  isComponentNode,
  isElementNode,
  walkVueTemplateAst,
} from './template/walk'

export {
  createTsMorph,
} from './ts-morph/create'

export {
  VinePropsDefinitionBy,
} from './types'
export type {
  HMRCompFnsName,
  VineCompilerCtx,
  VineCompilerHooks,
  VineCompilerOptions,
  VineDiagnostic,
  VineFileCtx,
  VineCompFnCtx as VineFnCompCtx,
  VineProcessorLang,
  VinePropMeta,
  VineQuery,
} from './types'

export {
  _breakableTraverse,
  exitTraverse,
} from './utils'

export {
  topoSort,
} from './utils/topo-sort'

export type {
  ComponentRelationsMap,
} from './utils/topo-sort'

export function createCompilerCtx(
  options: VineCompilerOptions = {},
): VineCompilerCtx {
  return {
    fileCtxMap: new Map(),
    vineCompileErrors: [],
    vineCompileWarnings: [],
    isRunningHMR: false,
    options: {
      inlineTemplate: true, // default inline template
      // Maybe some default options ...
      ...options,
    },
  }
}

export function createVineFileCtx(
  code: string,
  fileId: string,
  vineCompileCtx: VineCompileCtx,
): VineFileCtx {
  const { fileCtxCache, babelParseOptions = {} } = vineCompileCtx
  const root = babelParse(code, babelParseOptions)
  const vineFileCtx: VineFileCtx = {
    root,
    fileId,
    renderOnly: fileCtxCache ? fileCtxCache.renderOnly : false,
    hmrCompFnsName: fileCtxCache ? fileCtxCache.hmrCompFnsName : null,
    isCRLF: code.includes('\r\n'),
    fileMagicCode: new MagicString(code),
    vineCompFns: [],
    exportNamedDeclarations: findAllExportNamedDeclarations(root),
    userImports: {},
    styleDefine: {},
    vueImportAliases: {},
    get originCode() {
      return this.fileMagicCode.original
    },
    getAstNodeContent(node) {
      return this.originCode.slice(node.start!, node.end!)
    },
    getLinkedTSTypeLiteralNodeContent(node) {
      return `{ ${
        node.members.map((member) => {
          const memberOriginCode = this.originCode.slice(member.start!, member.end!)

          return `${
            (
              member.type === 'TSMethodSignature'
              || member.type === 'TSPropertySignature'
            )
              ? `${createLinkedCodeTag('left', this.getAstNodeContent(member.key).length)}${memberOriginCode}`
              : memberOriginCode
          }`
        }).join(', ')
      } }`
    },
  }
  return vineFileCtx
}

export function doValidateVine(
  vineCompilerHooks: VineCompilerHooks,
  vineFileCtx: VineFileCtx,
  vineCompFnDecls: Node[],
): void {
  validateVine(vineCompilerHooks, vineFileCtx, vineCompFnDecls)
  vineCompilerHooks.onValidateEnd?.()
}

export function doAnalyzeVine(
  vineCompilerHooks: VineCompilerHooks,
  vineFileCtx: VineFileCtx,
  vineCompFnDecls: Node[],
): void {
  analyzeVine(vineCompilerHooks, vineFileCtx, vineCompFnDecls)
  vineCompilerHooks.onAnalysisEnd?.()
}

export function compileVineTypeScriptFile(
  code: string,
  fileId: string,
  vineCompileCtx: VineCompileCtx,
  ssr = false,
): VineFileCtx {
  const { compilerHooks } = vineCompileCtx
  const compilerOptions = compilerHooks.getCompilerCtx().options
  // Using babel to validate vine declarations
  const vineFileCtx: VineFileCtx = createVineFileCtx(code, fileId, vineCompileCtx)
  compilerHooks.onBindFileCtx?.(fileId, vineFileCtx)

  const vineCompFnDecls = findVineCompFnDecls(vineFileCtx.root)

  // 1. Validate all vine restrictions
  doValidateVine(compilerHooks, vineFileCtx, vineCompFnDecls)

  // 2. Analysis
  doAnalyzeVine(compilerHooks, vineFileCtx, vineCompFnDecls)

  // 3. Codegen, or call it "transform"
  transformFile(
    vineFileCtx,
    compilerHooks,
    compilerOptions?.inlineTemplate ?? true,
    ssr,
  )

  compilerHooks.onEnd?.()

  return vineFileCtx
}
