import { adminAuth } from "./firebase-admin";

const PROJECT_ID = "climbing-transmitter-rrwfn";
const DATABASE_ID = "ai-studio-voicepipeline-5a6d4661-fdf9-4ad2-ad9f-2bc49ac07c88";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  mapValue?: { fields: { [key: string]: FirestoreValue } };
  arrayValue?: { values: FirestoreValue[] };
  nullValue?: null;
}

function toFirestoreValue(val: any): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    // Check if it's a Firestore timestamp representation or serverTimestamp
    if (val.toDate && typeof val.toDate === "function") {
      return { timestampValue: val.toDate().toISOString() };
    }
    const fields: { [key: string]: FirestoreValue } = {};
    for (const k of Object.keys(val)) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: FirestoreValue): any {
  if (!val) return null;
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return parseInt(val.integerValue!, 10);
  if ("doubleValue" in val) return val.doubleValue;
  if ("timestampValue" in val) return val.timestampValue;
  if ("nullValue" in val) return null;
  if ("mapValue" in val && val.mapValue) {
    const res: any = {};
    for (const k of Object.keys(val.mapValue.fields || {})) {
      res[k] = fromFirestoreValue(val.mapValue.fields[k]);
    }
    return res;
  }
  if ("arrayValue" in val && val.arrayValue) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  return null;
}

export function toFirestoreDoc(obj: any) {
  const fields: { [key: string]: FirestoreValue } = {};
  for (const k of Object.keys(obj)) {
    fields[k] = toFirestoreValue(obj[k]);
  }
  return { fields };
}

export function fromFirestoreDoc(doc: any) {
  if (!doc || !doc.fields) return null;
  const res: any = {};
  for (const k of Object.keys(doc.fields)) {
    res[k] = fromFirestoreValue(doc.fields[k]);
  }
  if (doc.name) {
    const parts = doc.name.split("/");
    res.id = parts[parts.length - 1];
  }
  return res;
}

/**
 * Gets a document from Firestore using the REST API with the user's ID token.
 */
export async function getDoc(token: string, collection: string, id: string): Promise<any | null> {
  const url = `${BASE_URL}/${collection}/${id}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    return fromFirestoreDoc(data);
  } catch (err: any) {
    console.error(`Error in getDoc REST (${collection}/${id}):`, err.message);
    throw err;
  }
}

/**
 * Sets (writes/updates) a document in Firestore using the REST API (PATCH).
 * If the document does not exist, it will be created.
 */
export async function setDoc(token: string, collection: string, id: string, data: any): Promise<any> {
  const url = `${BASE_URL}/${collection}/${id}`;
  const docBody = toFirestoreDoc(data);
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(docBody)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${errText}`);
    }
    const result = await res.json();
    return fromFirestoreDoc(result);
  } catch (err: any) {
    console.error(`Error in setDoc REST (${collection}/${id}):`, err.message);
    throw err;
  }
}

/**
 * Adds a document with an auto-generated ID (POST).
 */
export async function addDoc(token: string, collection: string, data: any): Promise<any> {
  const url = `${BASE_URL}/${collection}`;
  const docBody = toFirestoreDoc(data);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(docBody)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${errText}`);
    }
    const result = await res.json();
    return fromFirestoreDoc(result);
  } catch (err: any) {
    console.error(`Error in addDoc REST (${collection}):`, err.message);
    throw err;
  }
}

/**
 * Lists all documents in a collection.
 */
export async function listDocs(token: string, collection: string): Promise<any[]> {
  const url = `${BASE_URL}/${collection}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (!data.documents) {
      return [];
    }
    return data.documents.map(fromFirestoreDoc).filter(Boolean);
  } catch (err: any) {
    console.error(`Error in listDocs REST (${collection}):`, err.message);
    throw err;
  }
}

/**
 * Deletes a document from Firestore.
 */
export async function deleteDoc(token: string, collection: string, id: string): Promise<void> {
  const url = `${BASE_URL}/${collection}/${id}`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${errText}`);
    }
  } catch (err: any) {
    console.error(`Error in deleteDoc REST (${collection}/${id}):`, err.message);
    throw err;
  }
}
