/**
 * @type {import('vitepress').UserConfig}
 */

import mathjax3 from 'markdown-it-mathjax3';

const domain = 'book.ericv.me'
const url = `https://${domain}`
const desc = 'A book that covers topics around observability in modern software systems'
const title = 'Practical Observability'
const github = 'https://github.com/ericovlp12/practical-observability'

// Custom Elements for MathJax
const customElements = [
    'mjx-container',
    'mjx-assistive-mml',
    'math',
    'maction',
    'maligngroup',
    'malignmark',
    'menclose',
    'merror',
    'mfenced',
    'mfrac',
    'mi',
    'mlongdiv',
    'mmultiscripts',
    'mn',
    'mo',
    'mover',
    'mpadded',
    'mphantom',
    'mroot',
    'mrow',
    'ms',
    'mscarries',
    'mscarry',
    'mscarries',
    'msgroup',
    'mstack',
    'mlongdiv',
    'msline',
    'mstack',
    'mspace',
    'msqrt',
    'msrow',
    'mstack',
    'mstack',
    'mstyle',
    'msub',
    'msup',
    'msubsup',
    'mtable',
    'mtd',
    'mtext',
    'mtr',
    'munder',
    'munderover',
    'semantics',
    'math',
    'mi',
    'mn',
    'mo',
    'ms',
    'mspace',
    'mtext',
    'menclose',
    'merror',
    'mfenced',
    'mfrac',
    'mpadded',
    'mphantom',
    'mroot',
    'mrow',
    'msqrt',
    'mstyle',
    'mmultiscripts',
    'mover',
    'mprescripts',
    'msub',
    'msubsup',
    'msup',
    'munder',
    'munderover',
    'none',
    'maligngroup',
    'malignmark',
    'mtable',
    'mtd',
    'mtr',
    'mlongdiv',
    'mscarries',
    'mscarry',
    'msgroup',
    'msline',
    'msrow',
    'mstack',
    'maction',
    'semantics',
    'annotation',
    'annotation-xml',
];

export default {
    title: title,
    description: desc,
    lastUpdated: true,

    head: [
        // ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon_io/apple-touch-icon.png' }],
        // ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon_io/favicon-32x32.png' }],
        // ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon_io/favicon-16x16.png' }],
        // ['link', { rel: 'manifest', href: 'favicon_io/site.webmanifest' }],

        // Open graph protocol
        ['meta', { property: 'og:url', content: url }],
        ['meta', { property: 'og:title', content: title }],
        ['meta', { property: 'og:description', content: desc }],
        ['meta', { property: 'og:site_name', content: domain }],

        //twitter card tags additive with the og: tags
        ['meta', { name: 'twitter:domain', value: domain }],
        ['meta', { name: 'twitter:url', value: url }],
    ],

    markdown: {
        config: (md) => {
            md.use(require('markdown-it-footnote'));
            md.use(mathjax3);
        }
    },

    themeConfig: {
        siteTitle: title,
        outline: [2, 6],
        nav: [],
        socialLinks: [
            { icon: 'github', link: github },
        ],
        sidebar: [
            {
                text: 'Observability',
                link: '/observability/observability',
                items: [
                    {
                        text: 'Metrics', link: '/observability/metrics', items: [
                            {
                                text: 'Labels', link: '/observability/metrics/labels'
                            },
                            {
                                text: 'Types', link: '/observability/metrics/types', items: [
                                    {
                                        text: 'Counters', link: '/observability/metrics/types/counters'
                                    },
                                    {
                                        text: 'Gauges', link: '/observability/metrics/types/gauges'
                                    },
                                    {
                                        text: 'Histograms', link: '/observability/metrics/types/histograms'
                                    },
                                ]
                            },
                            {
                                text: 'Instrumenting Go', link: '/observability/metrics/instrumenting_go/intro', items: [
                                    {
                                        text: 'Simple Service', link: '/observability/metrics/instrumenting_go/simple_service'
                                    },
                                    {
                                        text: 'Middleware', link: '/observability/metrics/instrumenting_go/middlewares'
                                    },
                                    {
                                        text: 'Gin', link: '/observability/metrics/instrumenting_go/gin'
                                    },
                                    {
                                        text: 'Echo', link: '/observability/metrics/instrumenting_go/echo'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
        ]
    },

    vue: {
        template: {
            compilerOptions: {
                isCustomElement: (tag) => customElements.includes(tag),
            },
        },
    },
}
