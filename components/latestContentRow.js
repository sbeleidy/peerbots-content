import { useState, useEffect } from "react";
import firebaseApp from "../firebase";
import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import ContentRow from "./contentRow";

export default function LatestContentRow() {
  const [latestContent, setLatestContent] = useState([]);
  const db = getFirestore(firebaseApp);
  const fetchLatestContent = async () => {
    const q = query(
      collection(db, "content"),
      where("public", "==", true),
      limit(10)
    );
    const data = await getDocs(q);
    const newLatestContent = data.docs.map((doc) => {
      return {
        id: doc.id,
        data: doc.data(),
      };
    });
    setLatestContent(newLatestContent);
  };

  useEffect(() => {
    fetchLatestContent();
  }, []);
  return (
    <>
      <ContentRow content={latestContent}>
        <h3 className="text-xl font-bold">Latest Content</h3>
      </ContentRow>
    </>
  );
}
