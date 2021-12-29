import { useRouter } from "next/router";
import firebaseApp from "../../firebase";
import {
  getFirestore,
  collection,
  query,
  where,
  doc,
  getDocs,
  documentId,
  getDoc,
  addDoc,
  Timestamp,
  limit,
  updateDoc,
} from "firebase/firestore";
import { useState, useEffect, useRef } from "react";
import amplitude from "amplitude-js";
import Link from "next/link";
import ContentRow from "../../components/contentRow";

import { useFirebaseAuth } from "../../auth";

export default function ContentPage() {
  const { user, userInDb } = useFirebaseAuth();

  const [contentInfo, setContentInfo] = useState({});
  const [author, setAuthor] = useState({});
  const [reviews, setReviews] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [tags, setTags] = useState([]);
  const [contentAuthored, setContentAuthored] = useState(false);
  const [contentPurchased, setContentPurchased] = useState(false);
  const [copies, setCopies] = useState([]);

  const copyAsInput = useRef();

  const db = getFirestore(firebaseApp);

  const router = useRouter();
  const { contentId } = router.query;

  const listPublicly = async (e) => {
    if (contentAuthored) {
      const contentRef = doc(db, "content", contentId);
      await updateDoc(contentRef, { public: true, price: 0 });
      fetchContentDetails();
    }
  };

  const copyContent = async (e) => {
    e.preventDefault();
    const contentName = copyAsInput.current.value;
    let newContent = contentInfo;
    newContent.name = contentName;
    newContent.originalName = contentInfo.name;
    newContent.copyOf = doc(db, "content", contentId);
    newContent.copyDate = Timestamp.now();
    newContent.public = false;
    newContent.trusted = false;
    newContent.owner = doc(db, "users", userInDb.id);

    const data = await addDoc(collection(db, "content"), newContent);

    router.push(`/content/${data.id}`);
  };

  const checkContentOwned = async (content) => {
    if (userInDb && Object.keys(userInDb).length > 0) {
      if (userInDb.id == content.owner.id) {
        setContentAuthored(true);
        setContentPurchased(false);
        return true;
      }
      setContentAuthored(false);

      const q = query(
        collection(db, "sales"),
        where("content", "==", doc(db, "content", contentId)),
        where("buyer", "==", doc(db, "users", userInDb.id)),
        limit(1)
      );

      const data = await getDocs(q);

      setContentPurchased(data.docs.length > 0);

      return data.docs.length > 0;
    }
  };

  const acquireContent = async () => {
    if (!(contentAuthored || contentPurchased)) {
      const data = await addDoc(collection(db, "sales"), {
        buyer: doc(db, "users", userInDb.id),
        content: doc(db, "content", contentId),
        datetime: Timestamp.now(),
      });
      setContentPurchased(true);
    }
  };

  const fetchCopies = async () => {
    const copiesQuery = query(
      collection(db, "content"),
      where("copyOf", "==", doc(db, "content", contentId)),
      where("owner", "==", doc(db, "users", userInDb.id))
    );
    const data = await getDocs(copiesQuery);
    const copiesInDb = data.docs.map((doc) => {
      return {
        id: doc.id,
        data: doc.data(),
      };
    });
    setCopies(copiesInDb);
  };

  const fetchAuthor = async (contentInfoFromDb) => {
    const authorRef = doc(db, "users", contentInfoFromDb.owner.id);
    const author = await getDoc(authorRef);
    const authorInfo = author.data();
    setAuthor(authorInfo);
  };

  const fetchTags = async (contentInfoFromDb) => {
    const tagsIds = contentInfoFromDb.tags.map((tag) => {
      return tag.id;
    });
    const tagsQuery = query(
      collection(db, "tags"),
      where(documentId(), "in", tagsIds)
    );
    const tagsData = await getDocs(tagsQuery);
    const tagsFromDb = tagsData.docs.map((doc) => {
      return {
        id: doc.id,
        data: doc.data(),
      };
    });
    setTags(tagsFromDb);
  };

  const fetchReviews = async () => {
    const contentRef = doc(db, "content", contentId);
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("content", "==", contentRef)
    );
    const reviewsData = await getDocs(reviewsQuery);
    const reviewsFromDb = reviewsData.docs.map((doc) => {
      return {
        id: doc.id,
        data: doc.data(),
      };
    });

    const reviewersIds = reviewsFromDb.map((review) => review.data.user.id);
    if (reviewersIds.length > 0) {
      const reviewersQuery = query(
        collection(db, "users"),
        where(documentId(), "in", reviewersIds)
      );
      const reviewersData = await getDocs(reviewersQuery);
      const reviewersFromDb = reviewersData.docs.map((doc) => {
        return { id: doc.id, data: doc.data() };
      });
      setReviewers(reviewersFromDb);
      setReviews(reviewsFromDb);
    } else {
      setReviewers([]);
      setReviews([]);
    }
  };

  const fetchContentDetails = async () => {
    if (contentId) {
      const contentRef = doc(db, "content", contentId);
      const content = await getDoc(contentRef);

      if (content.exists()) {
        setContentInfo(content.data());
      } else {
        // Go to 404
      }
    }
  };
  useEffect(() => {
    fetchContentDetails();
  }, [contentId]);

  useEffect(() => {
    if (contentInfo && Object.keys(contentInfo).length != 0) {
      fetchAuthor(contentInfo);
      fetchTags(contentInfo);
      fetchReviews();
    }
  }, [contentInfo]);

  useEffect(() => {
    if (
      contentInfo &&
      userInDb &&
      Object.keys(contentInfo).length != 0 &&
      Object.keys(userInDb).length != 0
    ) {
      const contentOwned = checkContentOwned(contentInfo);
      if (contentOwned) {
        fetchCopies();
      }
    }
  }, [contentInfo, userInDb]);

  useEffect(() => {
    amplitude.getInstance().logEvent("Viewed Page: Content Details", {
      "Content ID": contentId,
    });
  }, []);

  return (
    <div>
      {/* Summary section */}
      <div className="bg-white shadow-md my-4 mx-2 rounded p-4">
        <div>
          <h1 className="text-2xl">{contentInfo.name}</h1>
        </div>
        <div>
          <span className="text-xs">Authored by</span>
          {author ? (
            <div className="text-gray-800">
              <span>
                {author.photoUrl ? (
                  <img
                    src={author.photoUrl}
                    className="h-8 inline-block rounded-full"
                  ></img>
                ) : (
                  <img
                    src="profile_pic.png"
                    className="h-8 inline-block rounded-full"
                  ></img>
                )}
              </span>
              <span className="ml-1 text-base">{author.name}</span>
            </div>
          ) : (
            <div></div>
          )}
        </div>
        <div className="my-2">
          {!contentInfo.copyOf && contentInfo.public && reviews ? (
            <>
              {reviews.length > 0 ? (
                <span>
                  <span className="text-accent-hc font-bold px-2 text-base">
                    {reviews.reduce((sum, { data }) => {
                      return sum + data.rating;
                    }, 0) / reviews.length}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 inline-block"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </span>
                  <span className="text-sm">({reviews.length} reviews)</span>
                </span>
              ) : (
                <span className="text-xs">No reviews yet</span>
              )}
            </>
          ) : (
            <span>{""}</span>
          )}
        </div>
        <div className="my-2">
          {tags &&
            tags.map((eachTag) => (
              <span
                key={eachTag.id}
                style={{
                  background: eachTag.data.color,
                  color: eachTag.data.textColor,
                }}
                className="rounded-3xl px-2 mx-1 text-xs"
              >
                {eachTag.data.name}
              </span>
            ))}
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white shadow-md my-4 mx-2 rounded p-4 ">
        <div>{contentInfo.description}</div>
      </div>

      {/* Public Listing Section */}
      {user && contentAuthored && !contentInfo.copyOf && !contentInfo.public && (
        <div className="bg-white shadow-md my-4 mx-2 rounded p-4">
          <div className="text-base">
            Would you like to list this content publicly?
          </div>
          <div className="text-sm">
            Listing content will make it publicly available to others for free!
            Listing content publicly will allow others to copy it and use it on
            the Peerbots app.{" "}
          </div>
          <div className="text-sm font-bold">
            Once content is public it can not be made private.
          </div>
          <div>
            <button className="btn-primary" onClick={listPublicly}>
              List this publicly for free!
            </button>
          </div>
        </div>
      )}

      {/* Reviews Section */}
      {contentInfo.public && !contentInfo.copyOf && reviews.length > 0 && (
        <div className="bg-white shadow-md my-4 mx-2 rounded p-4 ">
          <div>
            <h3 className="text-sm font-bold">Reviews</h3>
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white shadow-lg rounded p-4 w-64"
              >
                <div className="flex justify-between mb-2">
                  <div>
                    {review.data.rating}{" "}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 inline-block"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>

                  <div className="align-middle">
                    <span>
                      <img
                        src={
                          reviewers.filter((reviewer) => {
                            return reviewer.id == review.data.user.id;
                          })[0].data.photoUrl
                        }
                        className="rounded-full h-6 w-6 inline-block mr-1"
                      ></img>
                    </span>
                    <span className="text-sm">
                      {
                        reviewers.filter((reviewer) => {
                          return reviewer.id == review.data.user.id;
                        })[0].data.name
                      }
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  {review.data.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acquisition or Statistics Section */}
      {contentInfo.public && !contentInfo.copyOf && (
        <div className="bg-white shadow-md my-4 mx-2 rounded p-4 ">
          <div>
            {reviews && reviews.length > 0 ? (
              <span>
                <span className="text-accent-hc font-bold px-2 text-base">
                  {reviews.reduce((sum, { data }) => {
                    return sum + data.rating;
                  }, 0) / reviews.length}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline-block"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </span>
                <span className="text-sm">({reviews.length} reviews)</span>
              </span>
            ) : (
              <span className="text-xs">No reviews yet</span>
            )}
          </div>
          <div>
            {contentInfo.price == 0 ? (
              <span className="uppercase">Free</span>
            ) : (
              <span>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(contentInfo.price)}
              </span>
            )}
          </div>
          {user ? (
            <>
              {!(contentAuthored || contentPurchased) && (
                <div>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      amplitude
                        .getInstance()
                        .logEvent(
                          "Clicked Button: Content Details - Acquire Content",
                          {
                            "Content ID": contentId,
                          }
                        );
                      acquireContent();
                    }}
                  >
                    + Acquire Content
                  </button>{" "}
                </div>
              )}
            </>
          ) : (
            <div>
              <span className="text-sm">
                You must sign in to acquire content.
              </span>
              <button className="btn-primary" disabled>
                + Acquire Content
              </button>
            </div>
          )}
        </div>
      )}

      {/* Link to original section */}
      {contentInfo.copyOf && (
        <div className="bg-white shadow-md my-4 mx-2 rounded p-4">
          <span>
            This is a copy of{" "}
            <Link
              href="/content/[contentId]"
              as={`/content/${contentInfo.copyOf.id}`}
            >
              original content link
            </Link>
          </span>
        </div>
      )}

      {/* Copy this content section */}
      {user && (contentAuthored || contentPurchased) && (
        <div className="bg-white shadow-md my-4 mx-2 rounded p-4">
          <form onSubmit={copyContent}>
            <label>Copy As</label>
            <input
              type="text"
              ref={copyAsInput}
              className="input-base form-input"
              name="copyAs"
              placeholder={contentInfo.name}
            ></input>
            <button className="btn-primary" type="submit" onClick={copyContent}>
              {" "}
              Copy to App!
            </button>
          </form>
        </div>
      )}

      {/* Copies Section */}
      <div>
        {copies.length > 0 ? (
          <div>
            <ContentRow content={copies}>
              <h3>Your copies</h3>
            </ContentRow>
          </div>
        ) : (
          <div>{""}</div>
        )}
      </div>
    </div>
  );
}
