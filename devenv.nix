{
  pkgs,
  ...
}:

{
  languages.javascript = {
    enable = true;
    lsp.enable = true;
    lsp.package = pkgs.vtsls;
    pnpm.enable = true;
    pnpm.install.enable = true;
  };

  opencode = {
    enable = true;
    mcp = {
      devenv = {
        type = "local";
        command = [
          "devenv"
          "mcp"
        ];
        environment = {
          DEVENV_ROOT = "{env:DEVENV_ROOT}";
        };
      };
    };
  };

  git-hooks = {
    enable = true;
    hooks = {
      eslint.enable = true;
      treefmt.enable = true; # formatting via treefmt only, no standalone prettier hook
    };
  };

  treefmt = {
    enable = true;
    config.programs = {
      deadnix.enable = true; # nix dead-code removal
      nixfmt.enable = true; # devenv.nix
      prettier.enable = true; # .ts/.js/.json/.md
      statix.enable = true; # nix lint (anti-patterns)
    };
  };
}
