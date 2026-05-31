import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2는 S3 호환 API를 지원합니다.
export const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

/**
 * 프론트엔드에서 직접 R2로 파일을 업로드하기 위한 Pre-signed URL을 생성합니다.
 * @param key 저장될 파일의 고유 경로/이름 (예: projects/uuid/tracks/uuid/v1.wav)
 * @param contentType 오디오 파일의 MIME Type (예: audio/wav, audio/mpeg)
 * @returns {Promise<string>} 생성된 Pre-signed URL 문자열
 */
export async function generatePresignedUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  // 보안을 위해 URL 유효 시간을 1시간(3600초)으로 제한합니다.
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * 프론트엔드에서 재생할 오디오 파일의 Public 접근 URL을 반환합니다.
 * @param key R2 버킷에 저장된 Object Key
 */
export function getPublicUrl(key: string): string {
  // CORS가 허용된 Public 도메인을 통해 접근 (R2 대시보드에서 설정 필요)
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * 프론트엔드에서 삭제 요청된 오디오 파일을 R2에서 실제로 삭제합니다.
 * @param key R2 버킷에 저장된 Object Key
 */
export async function deleteFileFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  
  try {
    await s3Client.send(command);
  } catch (error) {
    console.error(`Failed to delete object ${key} from R2:`, error);
  }
}
