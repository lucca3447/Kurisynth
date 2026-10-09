import sys
import types
import torch
import torch.nn as nn
import torchaudio
import torchaudio.models.wav2vec2.utils.import_fairseq as imp


class DummyModule(types.ModuleType):
    def __getattr__(self, name):
        class DummyClass:
            def __init__(self, *args, **kwargs):
                pass
            def __setstate__(self, state):
                if isinstance(state, dict):
                    self.__dict__.update(state)
        return DummyClass


class FairseqFinder:
    def find_module(self, fullname, path=None):
        if fullname.startswith("fairseq"):
            return self
        return None

    def load_module(self, fullname):
        if fullname in sys.modules:
            return sys.modules[fullname]
        mod = DummyModule(fullname)
        sys.modules[fullname] = mod
        return mod


def register_fairseq_interceptor():
    if not any(isinstance(f, FairseqFinder) for f in sys.meta_path):
        sys.meta_path.insert(0, FairseqFinder())


class HubertWrapper(nn.Module):
    def __init__(self, model_path: str, is_half: bool = False, device: str = "cuda"):
        super().__init__()
        self.device = device
        self.is_half = is_half

        register_fairseq_interceptor()
        ckpt = torch.load(model_path, map_location="cpu", weights_only=False)
        converted = imp._convert_state_dict(ckpt["model"])
        
        self.model = torchaudio.models.hubert_base()
        self.model.load_state_dict(converted, strict=False)
        self.model.eval()

        if "final_proj.weight" in ckpt["model"]:
            w = ckpt["model"]["final_proj.weight"]
            b = ckpt["model"]["final_proj.bias"]
            self.final_proj = nn.Linear(w.shape[1], w.shape[0])
            self.final_proj.weight.data.copy_(w)
            self.final_proj.bias.data.copy_(b)
            self.final_proj.eval()
        else:
            self.final_proj = None

        if is_half:
            self.model = self.model.half()
            if self.final_proj is not None:
                self.final_proj = self.final_proj.half()

        self.model = self.model.to(device)
        if self.final_proj is not None:
            self.final_proj = self.final_proj.to(device)

    def extract_features(self, source, padding_mask=None, output_layer=12):
        if self.is_half:
            source = source.half()
        else:
            source = source.float()
        source = source.to(self.device)

        with torch.no_grad():
            feats_list, _ = self.model.extract_features(source, num_layers=output_layer)
            out_feats = feats_list[output_layer - 1]
            return [out_feats]
