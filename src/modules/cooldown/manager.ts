import type { AnyContext, SubCommand, UsingClient } from "seyfert";
import { CacheFrom, type ReturnCache } from "seyfert/lib/cache";
import { fakePromise, type PickPartial } from "seyfert/lib/common";
import {
  type CooldownData,
  CooldownResource,
  type CooldownType,
} from "./resource";

export class CooldownManager {
  private readonly resource: CooldownResource;

  constructor(public readonly client: UsingClient) {
    this.resource = new CooldownResource(client.cache, client);
  }

  private buildKey(name: string, type: CooldownType, target: string) {
    return `${name}:${type}:${target}`;
  }

  private resolveTarget(context: AnyContext, type: CooldownType): string {
    switch (type) {
      case "user":
        return context.author.id;
      case "guild":
        return context.guildId ?? context.author.id;
      case "channel":
        return context.channelId ?? context.author.id;
      default:
        return context.author.id;
    }
  }

  private getCommandData(
    name: string,
    guildId?: string,
  ): [string, CooldownProps] | undefined {
    if (!this.client.commands?.values?.length) return;

    for (const command of this.client.commands.values) {
      if (!("cooldown" in command)) continue;
      if (guildId && !command.guildId?.includes(guildId)) continue;

      if (command.name === name) {
        return [command.name, command.cooldown!];
      }

      if ("options" in command) {
        const option = command.options?.find(
          (x): x is SubCommand => x.name === name,
        );
        if (option) {
          return [option.name, option.cooldown ?? command.cooldown!];
        }
      }
    }
    return undefined;
  }

  has(options: CooldownHasOptions): ReturnCache<boolean> {
    const cmd = this.getCommandData(options.name, options.guildId);
    if (!cmd) return false;

    const [name, data] = cmd;
    const tokens = options.tokens ?? 1;
    const allowed = data.uses[options.use ?? "default"];
    if (tokens > allowed) return true;

    return fakePromise(
      this.resource.get(this.buildKey(name, data.type, options.target)),
    ).then((cooldown) => {
      if (!cooldown) {
        return fakePromise(
          this.set({
            name,
            target: options.target,
            type: data.type,
            interval: data.interval,
            remaining: allowed,
          }),
        ).then(() => false);
      }

      const remaining = Math.max(cooldown.remaining - tokens, 0);
      return remaining === 0;
    });
  }

  set(options: CooldownSetOptions) {
    return this.resource.set(
      CacheFrom.Gateway,
      this.buildKey(options.name, options.type, options.target),
      {
        interval: options.interval,
        remaining: options.remaining,
        lastDrip: options.lastDrip,
      },
    );
  }

  context(context: AnyContext, use?: keyof UsesProps, guildId?: string) {
    if (!("command" in context) || !("name" in context.command)) return true;
    if (!context.command.cooldown) return true;

    const target = this.resolveTarget(context, context.command.cooldown.type);
    return this.use({ name: context.command.name, target, use, guildId });
  }

  use(options: CooldownUseOptions): ReturnCache<number | true> {
    const cmd = this.getCommandData(options.name, options.guildId);
    if (!cmd) return true;

    const [name, data] = cmd;
    const key = this.buildKey(name, data.type, options.target);

    return fakePromise(this.resource.get(key)).then((cooldown) => {
      if (!cooldown) {
        return fakePromise(
          this.set({
            name,
            target: options.target,
            type: data.type,
            interval: data.interval,
            remaining: data.uses[options.use ?? "default"] - 1,
          }),
        ).then(() => true);
      }

      return fakePromise(
        this.drip({
          name,
          props: data,
          data: cooldown,
          target: options.target,
          use: options.use,
        }),
      ).then((drip) =>
        typeof drip === "number" ? data.interval - drip : true,
      );
    });
  }

  drip(options: CooldownDripOptions): ReturnCache<boolean | number> {
    const now = Date.now();
    const deltaMS = now - options.data.lastDrip;

    const key = this.buildKey(options.name, options.props.type, options.target);
    const uses = options.props.uses[options.use ?? "default"];

    if (deltaMS >= options.props.interval) {
      return fakePromise(
        this.resource.patch(CacheFrom.Gateway, key, {
          lastDrip: now,
          remaining: uses - 1,
        }),
      ).then(() => true);
    }

    if (options.data.remaining - 1 < 0) return deltaMS;

    return fakePromise(
      this.resource.patch(CacheFrom.Gateway, key, {
        remaining: options.data.remaining - 1,
      }),
    ).then(() => true);
  }

  refill(name: string, target: string, use: keyof UsesProps = "default") {
    const cmd = this.getCommandData(name);
    if (!cmd) return false;

    const [resolve, data] = cmd;
    return fakePromise(
      this.resource.patch(
        CacheFrom.Gateway,
        this.buildKey(resolve, data.type, target),
        {
          remaining: data.uses[use],
        },
      ),
    ).then(() => true);
  }
}

export interface CooldownProps {
  type: CooldownType;
  interval: number;
  uses: UsesProps;
}

export interface CooldownUseOptions {
  name: string;
  target: string;
  use?: keyof UsesProps;
  guildId?: string;
}

export interface CooldownDripOptions
  extends Omit<CooldownUseOptions, "guildId"> {
  props: CooldownProps;
  data: CooldownData;
}

export interface CooldownHasOptions extends CooldownUseOptions {
  tokens?: number;
}

export interface CooldownSetOptions
  extends PickPartial<CooldownData, "lastDrip"> {
  name: string;
  target: string;
  type: CooldownType;
}

export interface UsesProps {
  default: number;
}

declare module "seyfert" {
  interface Command {
    cooldown?: CooldownProps;
  }
  interface SubCommand {
    cooldown?: CooldownProps;
  }
  interface ContextMenuCommand {
    cooldown?: CooldownProps;
  }
  interface EntryPointCommand {
    cooldown?: CooldownProps;
  }
}
