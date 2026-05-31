interface D1QueryResponse<T = any> {
  result: T[];
  success: boolean;
  errors: any[];
  messages: any[];
}

/**
 * Cloudflare D1 HTTP API Wrapper
 * 서버사이드(Node.js/Edge) 환경에서 D1 쿼리를 직접 수행합니다.
 * @param sql 실행할 SQL 쿼리 문자열
 * @param params 바인딩할 파라미터 배열 (순서대로 매핑됨)
 */
export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<D1QueryResponse<T> | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !dbId || !token) {
    console.error("Missing Cloudflare D1 credentials in environment variables.");
    return null;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("D1 query failed:", errorData);
      throw new Error(`D1 query failed: ${response.statusText}`);
    }

    // Cloudflare D1 HTTP API response format usually wraps the array of query results
    // Example: { result: [ { results: [...] } ], success: true }
    const data = await response.json();
    
    // Extract the actual results array from the first statement execution
    if (data.success && data.result && data.result.length > 0) {
      return {
        success: true,
        result: data.result[0].results || [],
        errors: data.errors,
        messages: data.messages
      };
    }

    return data as D1QueryResponse<T>;
  } catch (error) {
    console.error("Error executing D1 query:", error);
    return null;
  }
}
