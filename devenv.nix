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
}
