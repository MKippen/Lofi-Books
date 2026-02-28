# Writing Tools Page + Sidebar Reorder

## What we're building
A "Writing Tools" page with dictionary and thesaurus lookup, accessible from the sidebar. Also reordering the sidebar bottom section per Molly's request.

## Sidebar reorder (current → new)

**Current order (bottom half):**
1. HR with star
2. Wish List
3. Plant
4. Settings
5. Back to Books

**New order:**
1. Plant
2. HR with star
3. Writing Tools (new)
4. Wish List
5. Settings
6. Back to Books

## Writing Tools Page

A clean page with two tools side by side (or stacked on mobile):

### Dictionary
- Search input field
- Calls the free [DictionaryAPI](https://api.dictionaryapi.dev/api/v2/entries/en/{word})
- Displays: word, phonetic, part of speech, definitions, example sentences

### Thesaurus
- Search input field
- Uses the same DictionaryAPI (it includes synonyms/antonyms in the response)
- Displays: synonyms and antonyms grouped by meaning
- Clickable synonyms/antonyms that auto-search that word

## Files to create/modify

1. **`src/features/tools/WritingToolsPage.tsx`** — Main page with Dictionary + Thesaurus panels
2. **`src/pages/WritingToolsPage.tsx`** — Re-export (follows existing pattern)
3. **`src/App.tsx`** — Add route `tools` under `/book/:bookId`
4. **`src/components/layout/Sidebar.tsx`** — Add Writing Tools nav item + reorder bottom section (plant above HR, Writing Tools + Wish List below HR, then Settings + Back to Books)

No server changes needed — dictionary/thesaurus calls go directly to the free public API from the browser.
