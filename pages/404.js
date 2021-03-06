import Image from "next/image";
import Link from "next/link";
import peerbotBackpack from "../public/peerbot-backpack.webp";

export default function NotFound() {
  return (
    // <div className="bg-white shadow-md my-4 mx-2 p-8 rounded w-full flex md:flex-row-reverse">
    <div className="bg-white shadow-md my-4 mx-2 p-8 rounded w-full md:flex-row flex flex-col-reverse">
      <div className="w-72 mt-4">
        <Image src={peerbotBackpack} />
      </div>
      <div className="text-xl md:mt-8">
        <div className="mb-2">
          Sorry, I could not find the page you are looking for.
        </div>
        <div>
          Try going to the{" "}
          <Link href="/" as="/">
            <a className="underline text-dark-primary">home page</a>
          </Link>{" "}
          and starting over?
        </div>
      </div>
    </div>
  );
}
