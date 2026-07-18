const fs = require('fs'); 
const code = "'use client'\nimport { useState } from 'react'\nimport AdresseAutocomplete from '@/components/AdresseAutocomplete'\nexport default function Page() { const [nom, setNom] = useState(''); return ^<div^>^<h1^>Demande^</h1^>^<input type=\"text\" placeholder=\"Nom\" value={nom} onChange={(e) =^> setNom(e.target.value)} /^>^<AdresseAutocomplete label=\"Depart\" onSelect={(a) =^> console.log(a)} /^>^<AdresseAutocomplete label=\"Destination\" onSelect={(a) =^> console.log(a)} /^>^</div^> }"; 
fs.writeFileSync('app/demande/page.tsx', code, 'utf8'); 
