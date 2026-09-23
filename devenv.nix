{
  pkgs,
  lib,
  config,
  inputs,
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
}
