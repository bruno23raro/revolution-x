'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface TemplateBodyProps {
  body: string;
  onBodyChange: (body: string) => void;
}

export function TemplateBody({ body, onBodyChange }: TemplateBodyProps) {
  const variables = ['{{1}}', '{{2}}', '{{3}}', '{{4}}', '{{5}}', '{{6}}', '{{7}}', '{{8}}', '{{9}}', '{{10}}'];

  const handleClick = (index: number) => {
    if (!body.includes(variables[index])) {
      const newBody = body ? body.replace(/\s*$/, ` ${variables[index]}`) : variables[index];
      onBodyChange(newBody);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Corpo do Template</Label>
      <Textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={4}
        placeholder="Digite o texto do template aqui..."
      />
      <div className="flex flex-wrap gap-1 mt-2">
        {variables.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(i)}
            className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
          >
            {v}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Clique nos placeholders para inseri-los no texto. São substituídos na hora do envio.
      </p>
    </div>
  );
}