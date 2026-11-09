import * as ImagePicker from 'expo-image-picker';

/** Une image de la galerie : photo libre marquée « importée », jamais une preuve (section 6). */
export async function pickFromGallery(): Promise<{
  uri: string;
  width: number;
  height: number;
} | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
  } catch {
    return null;
  }
}
