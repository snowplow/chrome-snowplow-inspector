import { h, type FunctionComponent, Fragment } from "preact";
import { useState, type Dispatch, type StateUpdater } from "preact/hooks";

import type { OAuthResult } from "../../ts/types";

import { Brochure } from "./Brochure";
import {
  SignalsClient,
  type AttributeGroup,
  type AttributeKey,
} from "./SignalsClient";

import logo from "@res/logo.svg";

const AttributeRow: FunctionComponent<{
  name: string;
  value: string | number;
  description?: string | null;
  attributesJson: Record<string, unknown>[];
}> = ({ name, value, description, attributesJson }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full justify-start items-center py-2 px-5 hover:bg-gray-800"
      >
        <div className="flex w-[160px] break-all">
          <span className="text-gray-300 text-sm font-mono inline-block">
            {name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white bg-black px-2 py-1 rounded">
            {String(value)}
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="bg-[#3c3c3c]">
          <p className="text-white text-sm">Description</p>
          <p className="text-gray-300 text-sm">
            {description || "No description available."}
          </p>
          <div>{JSON.stringify(attributesJson, null, 2)}</div>
        </div>
      )}
    </>
  );
};

const AttributeSection = ({
  title,
  type,
  attributes,
  attributeGroup,
  defaultOpen = false,
}: {
  title: string;
  type: string;
  attributes: { name: string; value: string | number }[];
  attributeGroup: AttributeGroup;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#232323] px-2 py-3 bg-[#191919]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-white font-bold">{title}</span>
        </div>
        <span className="text-sm text-white bg-black px-2 py-1 rounded">
          {type}
        </span>
      </button>
      {isOpen && (
        <div className="">
          {attributes.map((attr, index) => (
            <AttributeRow
              key={index}
              name={attr.name}
              value={attr.value}
              description={attributeGroup.description}
              attributesJson={attributeGroup.attributes}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AttributeGroupData: FunctionComponent<{
  attributeGroup: AttributeGroup;
}> = ({ attributeGroup }) => {
  const type =
    attributeGroup.online && !attributeGroup.offline ? "Stream" : "Batch";
  const title = `${attributeGroup.name} (v${attributeGroup.version})`;

  // TODO needs to replace with real attribute values from get-online-attributes
  const transformedAttributes = attributeGroup.attributes.map((attr) => ({
    name: attr.name,
    value: "N/A",
  }));

  return (
    <AttributeSection
      title={title}
      type={type}
      attributes={transformedAttributes}
      attributeGroup={attributeGroup}
    />
  );
};

const SignalsData = ({ groups }: { groups: AttributeGroup[] }) => (
  <div className="space-y-0">
    {groups.map((g) => (
      <AttributeGroupData key={`${g.name}_${g.version}`} attributeGroup={g} />
    ))}
  </div>
);

const AttributesUI: FunctionComponent<{
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: {
    client: SignalsClient;
    keys: AttributeKey[];
    groups: AttributeGroup[];
  }[];
}> = ({ attributeKeyIds, signalsDefs }) => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="flex h-full w-full bg-[#1F2020] text-white">
      {/* Sidebar */}
      <aside className="w-80 p-6 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8">
            <img alt="Snowplow logo" src={logo} className="w-full h-full" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          Signals
          <br /> Behavioral Attributes
        </h1>

        <p className="text-sm text-[#999999] mb-6 leading-relaxed">
          Behavioral attributes are indicators derived from your online
          activities, reflecting how you interact with content and services.
          These signals can be tailored to meet your specific business needs,
          allowing for a personalized approach to user engagement.
        </p>

        <div>
          <button className="bg-[#916CE7] hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors">
            Learn more
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col py-4 px-8 border-l border-[#FFFFFF1F]">
        {/* Header with Search */}
        <header className="mb-2">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search Behaviors Attributes"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm((e.target as HTMLInputElement).value)
                }
                className="w-full pl-10 pr-4 py-2 bg-[#191919] border-none rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
              />
            </div>
          </div>
        </header>

        {/* Attributes List */}
        <div className="flex-1 overflow-auto">
          {signalsDefs.map(
            (data, i) => data && <SignalsData key={i} {...data} />,
          )}
        </div>
      </main>
    </div>
  );
};

export const Attributes = ({
  attributeKeyIds,
  login,
  signalsDefs,
  signalsInfo,
}: {
  login?: OAuthResult;
  setAttributeCount: Dispatch<StateUpdater<number | undefined>>;
  attributeKeyIds: Record<string, Set<string>>;
  signalsDefs: {
    client: SignalsClient;
    keys: AttributeKey[];
    groups: AttributeGroup[];
  }[];
  signalsInfo: Record<string, string[]>;
}) => {
  const signalsAvailable = true;
  return (
    <div key="app" className="h-full w-full">
      {signalsAvailable ? (
        <AttributesUI
          attributeKeyIds={attributeKeyIds}
          signalsDefs={signalsDefs}
        />
      ) : (
        <Brochure login={login} />
      )}
    </div>
  );
};
