const fs = require('fs');

// CSS files to minify
const files = [
  'src/app/modules/factura/listar-facturas/listar-facturas.css',
  'src/app/modules/factura/ver-factura/ver-factura.css',
  'src/app/modules/clientes/pages/historial-clinico/historial-clinico.css',
  'src/app/modules/ventas/crear-venta/crear-venta.css',
  'src/app/shared/components/auth/auth-carousel.scss',
];

files.forEach((file) => {
  try {
    const content = fs.readFileSync(file, 'utf8');

    // Aggressive CSS minification
    const minified = content
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove all unnecessary whitespace and newlines
      .replace(/\s+/g, ' ')
      // Remove spaces around special characters
      .replace(/\s*([{}:;,>~+\[\]])\s*/g, '$1')
      // Remove last semicolon in blocks
      .replace(/;}/g, '}')
      // Remove spaces around parentheses
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      // Remove quotes from URLs if safe
      .replace(/url\((['"])([^'"]+)\1\)/g, 'url($2)')
      // Convert 0px to 0
      .replace(/\b0(px|em|rem|vh|vw|%)/g, '0')
      // Convert 0.X to .X
      .replace(/\b0+\.(\d+)/g, '.$1')
      // Remove trailing zeros
      .replace(/(\.\d*?)0+([^\d])/g, '$1$2')
      // Shorten color codes (#aabbcc to #abc)
      .replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi, '#$1$2$3')
      // Trim
      .trim();

    // Write minified content without BOM or extra bytes
    fs.writeFileSync(file, minified, { encoding: 'utf8', flag: 'w' });

    const originalSize = content.length;
    const minifiedSize = minified.length;
    const saved = originalSize - minifiedSize;
    const percentage = ((saved / originalSize) * 100).toFixed(2);

    console.log(`✅ ${file}`);
    console.log(`   Original: ${originalSize} bytes`);
    console.log(`   Minified: ${minifiedSize} bytes`);
    console.log(`   Saved: ${saved} bytes (${percentage}%)\n`);
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log('✨ Minificación agresiva completada!');
