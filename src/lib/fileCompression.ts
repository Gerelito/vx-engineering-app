/**
 * Utilidades para compresión de imágenes en el cliente y validación de archivos PDF
 * Almacenamiento directo en Firestore (subcolecciones) sin Cloud Storage.
 */

export interface ArchivoProcesado {
  base64Data: string;
  formato: 'jpeg' | 'png' | 'pdf';
  tamanioBytes: number;
  nombreOriginal: string;
}

/**
 * Comprime una imagen a JPEG con lado mayor máximo de 1280px, calidad ~0.6 y objetivo <= 200 KB.
 * Para archivos PDF, valida que no exceda 700 KB.
 */
export async function procesarArchivoAdjunto(file: File): Promise<ArchivoProcesado> {
  const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (esPdf) {
    const LIMITE_PDF_BYTES = 700 * 1024; // 700 KB
    if (file.size > LIMITE_PDF_BYTES) {
      const mbActual = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `El PDF seleccionado pesa ${mbActual} MB y supera el límite de 700 KB permitido para almacenamiento directo en base de datos. Por favor toma o sube una fotografía clara del documento firmado.`
      );
    }

    const base64Data = await leerComoDataUrl(file);
    return {
      base64Data,
      formato: 'pdf',
      tamanioBytes: file.size,
      nombreOriginal: file.name,
    };
  }

  // Si es imagen: comprimir con canvas a max 1280px y calidad ~0.6
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido o no reconocido.'));
      img.onload = () => {
        try {
          const MAX_DIM = 1280;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('No se pudo inicializar el procesador gráfico del navegador.'));
          }

          // Fondo blanco para imágenes con transparencia antes de convertir a JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Calidad inicial 0.6
          let quality = 0.6;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          // Si supera 250 KB, optimizar ligeramente
          let approxBytes = Math.round((dataUrl.length * 3) / 4);
          if (approxBytes > 250 * 1024 && quality > 0.45) {
            quality = 0.48;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            approxBytes = Math.round((dataUrl.length * 3) / 4);
          }

          resolve({
            base64Data: dataUrl,
            formato: 'jpeg',
            tamanioBytes: approxBytes,
            nombreOriginal: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
