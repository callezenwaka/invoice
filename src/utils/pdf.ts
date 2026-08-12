import type { TDocumentDefinitions } from 'pdfmake/interfaces'

/**
 * Renders a document definition to a PDF.
 *
 * pdfmake plus its fonts is roughly 1.9 MB, so it is imported on first use
 * rather than at startup — a user who never exports never pays for it. The
 * promise is cached, so concurrent exports load it once.
 *
 * Fonts: pdfmake ships Roboto. Matching Industry's Barlow means building a
 * custom virtual filesystem with the library's `build-vfs.js` and swapping the
 * import below; nothing else changes.
 */

type PdfMake = typeof import('pdfmake/build/pdfmake')

let loading: Promise<PdfMake> | null = null

async function pdfMake(): Promise<PdfMake> {
  if (!loading) {
    loading = (async () => {
      const [module, fonts] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
      ])

      // A UMD bundle: the interop default carries the API, and the namespace
      // does when the bundler synthesises named exports.
      const instance = (module as { default?: PdfMake }).default ?? module

      /**
       * The fonts have to be registered by hand.
       *
       * `vfs_fonts.js` self-registers only when `window.pdfMake` exists, which
       * is never true under an ESM import — so without this the bundled Roboto
       * is absent and every export dies on "Roboto-Medium.ttf not found in
       * virtual file system".
       */
      const vfs = (fonts as { default?: unknown }).default ?? fonts
      instance.addVirtualFileSystem(vfs as Parameters<typeof instance.addVirtualFileSystem>[0])

      return instance
    })()

    // A failed load must not be cached, or every later export inherits it.
    loading.catch(() => {
      loading = null
    })
  }

  return loading
}

export async function toBlob(definition: TDocumentDefinitions): Promise<Blob> {
  const instance = await pdfMake()
  return instance.createPdf(definition).getBlob()
}

/** For previewing in an iframe — the real document, not an approximation of it. */
export async function toDataUrl(definition: TDocumentDefinitions): Promise<string> {
  const instance = await pdfMake()
  return instance.createPdf(definition).getDataUrl()
}

/**
 * Saves the PDF under an explicit filename.
 *
 * Goes through an anchor rather than pdfmake's own `download`, so the same path
 * works for any blob and the name is always ours to set.
 */
export async function download(definition: TDocumentDefinitions, filename: string): Promise<void> {
  const blob = await toBlob(definition)
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** `INV-0007.pdf`, with anything a filesystem would reject stripped out. */
export function pdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[/\\:*?"<>|]/g, '-').trim()
  return `${safe || 'invoice'}.pdf`
}
