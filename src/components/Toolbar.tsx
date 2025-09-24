import { h, FunctionComponent } from "preact";
import { ListTree, Pyramid, DatabaseZap, GitBranchPlus } from "lucide-preact";

import { Application, IToolbar } from "../ts/types";
import { ConsoleStatus } from "./ConsoleStatus";

export const Toolbar: FunctionComponent<IToolbar> = ({
  application,
  eventCount,
  login,
  setApp,
  setLogin,
  signalsInfo,
}) => {
  const status =
    typeof eventCount == "number"
      ? eventCount > 0
        ? "active"
        : "inactive"
      : "";

  const enableSignals = Object.values(signalsInfo).some(Boolean);
  return (
    <header class="toolbar flex flex-col items-stretch justify-between">
      <nav
        class="toolbar__tabs flex-1 flex flex-col items-stretch pt-4 pl-1 gap-1"
        onChange={(e) => {
          if (e.target instanceof HTMLInputElement) {
            e.stopPropagation();
            setApp(e.target.value as Application);
          }
        }}
      >
        <label class={`flex flex-col justify-center items-center rounded-l cursor-pointer select-none px-6 py-8 ml-1 text-center transition-colors duration-200 ${
          application === "debugger"
            ? "bg-[hsl(var(--background))]"
            : "bg-transparent hover:bg-[hsl(var(--accent))]"
        }`}>
          <input
            type="radio"
            name="application"
            value="debugger"
            checked={application === "debugger"}
            class="hidden"
          />
          <div class="relative">
            <ListTree
              size={16}
              class={application === "debugger"
                ? "text-[hsl(var(--muted-foreground))]"
                : "text-[hsl(var(--foreground))]"
              }
            />
            {status && (
              <span
                class={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-transparent ${
                  status === 'active'
                    ? 'border-purple-500'
                    : status === 'inactive'
                      ? 'border-red-500'
                      : ''
                }`}
              />
            )}
          </div>
          <span class={application === "debugger"
            ? "text-[hsl(var(--muted-foreground))]"
            : "text-[hsl(var(--foreground))]"
          }>Events</span>
          {eventCount ? (
            <span class={application === "debugger"
              ? "text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--foreground))]"
            }>{eventCount}</span>
          ) : null}
        </label>
        <label class={`flex flex-col justify-center items-center rounded-l cursor-pointer select-none px-6 py-8 ml-1 text-center transition-colors duration-200 ${
          application === "schemaManager"
            ? "bg-[hsl(var(--background))]"
            : "bg-transparent hover:bg-[hsl(var(--accent))]"
        }`}>
          <input
            type="radio"
            name="application"
            value="schemaManager"
            checked={application === "schemaManager"}
            class="hidden"
          />
          <Pyramid
            size={16}
            class={application === "schemaManager"
              ? "text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--foreground))]"
            }
          />
          <span class={application === "schemaManager"
            ? "text-[hsl(var(--muted-foreground))]"
            : "text-[hsl(var(--foreground))]"
          }>Data Structures</span>
        </label>
        {enableSignals && (
          <label class={`flex flex-col justify-center items-center rounded-l cursor-pointer select-none px-6 py-8 ml-1 text-center transition-colors duration-200 ${
            application === "attributes"
              ? "bg-[hsl(var(--background))]"
              : "bg-transparent hover:bg-[hsl(var(--accent))]"
          }`}>
            <input
              type="radio"
              name="application"
              value="attributes"
              checked={application === "attributes"}
              class="hidden"
            />
            <DatabaseZap
              size={16}
              class={application === "attributes"
                ? "text-[hsl(var(--muted-foreground))]"
                : "text-[hsl(var(--foreground))]"
              }
            />
            <span class={application === "attributes"
              ? "text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--foreground))]"
            }>Attributes</span>
          </label>
        )}
        {enableSignals && (
          <label class={`flex flex-col justify-center items-center rounded-l cursor-pointer select-none px-6 py-8 ml-1 text-center transition-colors duration-200 ${
            application === "interventions"
              ? "bg-[hsl(var(--background))]"
              : "bg-transparent hover:bg-[hsl(var(--accent))]"
          }`}>
            <input
              type="radio"
              name="application"
              value="interventions"
              checked={application === "interventions"}
              class="hidden"
            />
            <GitBranchPlus
              size={16}
              class={application === "interventions"
                ? "text-[hsl(var(--muted-foreground))]"
                : "text-[hsl(var(--foreground))]"
              }
            />
            <span class={application === "interventions"
              ? "text-[hsl(var(--muted-foreground))]"
              : "text-[hsl(var(--foreground))]"
            }>Signals</span>
          </label>
        )}
      </nav>
      <ConsoleStatus login={login} setLogin={setLogin} />
    </header>
  );
};
