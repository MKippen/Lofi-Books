import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import IllustrationEmbedView from './IllustrationEmbedView';

/**
 * Custom TipTap Node for embedding chapter illustrations inline.
 *
 * Stores illustrationId, imageId, and caption as attributes so the
 * reader can later look them up and render creative presentations.
 *
 * HTML output: <illustration-embed data-illustration-id="..." data-image-id="..." data-caption="..."></illustration-embed>
 */
export const IllustrationEmbed = Node.create({
  name: 'illustrationEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      illustrationId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-illustration-id'),
        renderHTML: (attributes) => ({
          'data-illustration-id': attributes.illustrationId,
        }),
      },
      imageId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image-id'),
        renderHTML: (attributes) => ({
          'data-image-id': attributes.imageId,
        }),
      },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption') || '',
        renderHTML: (attributes) => ({
          'data-caption': attributes.caption,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'illustration-embed' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['illustration-embed', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(IllustrationEmbedView);
  },
});
