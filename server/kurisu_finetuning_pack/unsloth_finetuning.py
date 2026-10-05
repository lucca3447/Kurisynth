"""
=============================================================================
Kurisu Unsloth Fine-Tuning Script (Google Colab / Local GPU)
=============================================================================
Fine-tunes Llama-3.1-8B-Instruct or Gemma-2-9B-It on the Kurisu dataset.
Compatible with Google Colab Free Tier (Tesla T4 GPU).

Usage in Colab:
!pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps "xformers<0.0.27" trl peft accelerate bitsandbytes
python unsloth_finetuning.py
=============================================================================
"""

import os
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# 1. Load Unsloth 4-bit Base Model
try:
    from unsloth import FastLanguageModel
except ImportError:
    print("Unsloth not installed! Install via: pip install unsloth")
    exit(1)

max_seq_length = 2048
dtype = None # Auto detection
load_in_4bit = True

# Recommended Base Models:
# - "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit"
# - "unsloth/gemma-2-9b-it-bnb-4bit"
# - "unsloth/Qwen2.5-7B-Instruct-bnb-4bit"
MODEL_NAME = "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit"

print(f"Loading {MODEL_NAME}...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=max_seq_length,
    dtype=dtype,
    load_in_4bit=load_in_4bit,
)

# 2. Add LoRA Adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)

# 3. Load Enhanced Dataset
dataset_path = "kurisu_finetuning_dataset_enhanced.jsonl"
dataset = load_dataset("json", data_files=dataset_path, split="train")

def formatting_prompts_func(examples):
    convos = examples["messages"]
    texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
    return {"text": texts}

dataset = dataset.map(formatting_prompts_func, batched=True)

# 4. Train with SFTTrainer
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=max_seq_length,
    dataset_num_proc=2,
    packing=False,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        max_steps=60,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=1,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=3407,
        output_dir="outputs",
    ),
)

print("Starting Kurisu fine-tuning...")
trainer.train()

# 5. Save LoRA model & export to GGUF
print("Saving fine-tuned LoRA model...")
model.save_pretrained_merged("amadeus_kurisu_lora", tokenizer, save_method="lora")

# Optional GGUF export for Ollama:
# model.save_pretrained_gguf("amadeus_kurisu_gguf", tokenizer, quantization_method="q4_k_m")
print("Fine-tuning complete! Model saved in ./amadeus_kurisu_lora")
