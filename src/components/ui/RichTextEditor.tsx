import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { sanitizeRichText } from '../../lib/richText';

export interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Einfacher Rich-Text: fett, kursiv, Listen, Zitat, Links.
 *
 * Bewusst **ohne** Bilder, Videos und Tabellen. Der TT-Planer hat sie, aber sie kosten
 * Speicher, Bandbreite und eine Bereinigung, die man nie ganz fertig bekommt — für eine
 * Terminbeschreibung reichen ein paar Absätze und eine Liste.
 */
export default function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: RichTextEditorProps) {
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Ein Termin ist kein Blogartikel: kein Code-Block, keine Trennlinien.
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    onUpdate: ({ editor: instance }) => onChange(sanitizeRichText(instance.getHTML())),
    editorProps: {
      attributes: {
        class: 'prose-sm min-h-[8rem] max-w-none px-3 py-2 focus:outline-none',
        ...(id ? { id } : {}),
      },
    },
  });

  // Wird der Dialog mit anderen Daten neu geöffnet, muss der Inhalt mitziehen.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      // `emitUpdate: false`, sonst löste das Setzen ein onUpdate aus und das Formular
      // hielte sich selbst für geändert. In tiptap 2 hieß dieser Parameter schlicht `false`.
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // Absichtlich nur an `value` gehängt: bei jedem Tastendruck neu zu setzen würde
    // den Cursor ans Ende springen lassen.
  }, [value, editor]);

  if (!editor) return null;

  function setLink() {
    const previous = editor!.getAttributes('link').href as string | undefined;
    const url = window.prompt('Adresse des Links', previous ?? 'https://');

    if (url === null) return;
    if (url === '') {
      editor!.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="rounded-xl border border-gray-300 focus-within:border-primary">
      <div className="flex flex-wrap gap-0.5 border-b border-gray-200 p-1">
        <ToolButton
          icon={Bold}
          label="Fett"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolButton
          icon={Italic}
          label="Kursiv"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          icon={List}
          label="Aufzählung"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          icon={ListOrdered}
          label="Nummerierte Liste"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          icon={Quote}
          label="Zitat"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          icon={Link2}
          label="Link"
          active={editor.isActive('link')}
          onClick={setLink}
        />
        <span className="flex-1" />
        <ToolButton
          icon={Undo2}
          label="Rückgängig"
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          icon={Redo2}
          label="Wiederherstellen"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      <EditorContent editor={editor} />

      {placeholder && editor.isEmpty && (
        <p className="pointer-events-none -mt-8 px-3 text-sm text-gray-400">{placeholder}</p>
      )}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active ?? false}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
