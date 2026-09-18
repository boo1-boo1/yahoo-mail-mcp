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
    bun.enable = true;
    bun.install.enable = true;
  };
}
